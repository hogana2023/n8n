export { default } from "next-auth/middleware";

// Everything under /app requires a session; next-auth bounces anonymous
// visitors to the signIn page configured in authOptions with a callbackUrl.
export const config = {
  matcher: ["/app/:path*"],
};
