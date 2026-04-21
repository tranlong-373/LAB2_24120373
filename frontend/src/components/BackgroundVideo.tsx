const BACKGROUND_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

export function BackgroundVideo() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-background" aria-hidden="true">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src={BACKGROUND_VIDEO_URL} type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-[1] bg-[#001722]/70" />
      <div className="cinematic-shadow absolute inset-0 z-[2]" />
    </div>
  );
}
