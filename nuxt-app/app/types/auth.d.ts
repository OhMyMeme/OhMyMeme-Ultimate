declare module '#auth-utils' {
  interface User {
    name?: string
  }

  interface UserSession {
    loggedInAt?: string
  }
}

export {}
