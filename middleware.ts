export { default } from "next-auth/middleware";
export const config = {
  matcher: [
    "/",
    "/trades/:path*",
    "/coach",
    "/review",
    "/scan",
    "/options",
    "/import",
  ],
};
