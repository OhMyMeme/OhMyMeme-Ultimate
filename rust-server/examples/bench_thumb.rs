// Benchmarks thumbnail generation cost (esp. lossless WebP encoding vs sharp's lossy).
// Usage: cargo run --example bench_thumb --offline
use std::time::Instant;

fn generate_thumbnail(data: &[u8]) -> Option<Vec<u8>> {
    let img = image::load_from_memory(data).ok()?;
    let (w, h) = (img.width(), img.height());
    if w == 0 || h == 0 {
        return None;
    }
    let scale = (256.0 / w as f32).max(256.0 / h as f32).min(1.0);
    let nw = ((w as f32 * scale).round() as u32).max(1);
    let nh = ((h as f32 * scale).round() as u32).max(1);
    let downscaled = image::imageops::thumbnail(&img, nw, nh);
    let cw = 256.min(downscaled.width());
    let ch = 256.min(downscaled.height());
    let x = (downscaled.width().saturating_sub(cw)) / 2;
    let y = (downscaled.height().saturating_sub(ch)) / 2;
    let cropped = image::imageops::crop_imm(&downscaled, x, y, cw, ch).to_image();
    let mut out = Vec::new();
    let encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut out);
    cropped.write_with_encoder(encoder).ok()?;
    Some(out)
}

fn bench(size: u32) {
    let img = image::RgbImage::from_fn(size, size, |x, y| {
        image::Rgb([(x % 251) as u8, (y % 233) as u8, ((x + y) % 199) as u8])
    });
    let mut png = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .unwrap();
    // warmup
    let _ = generate_thumbnail(&png);
    let start = Instant::now();
    let thumb = generate_thumbnail(&png);
    let elapsed = start.elapsed();
    println!(
        "{size}x{size} png={}KB -> thumb={}B in {:.1}ms",
        png.len() / 1024,
        thumb.as_ref().map(|t| t.len()).unwrap_or(0),
        elapsed.as_secs_f64() * 1000.0
    );
}

fn main() {
    println!("thumbnail generation cost (lossless WebP, 256px cover):");
    bench(256);
    bench(512);
    bench(1024);
    bench(2048);
    bench(4096);
}
