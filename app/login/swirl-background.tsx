import Image from "next/image";
import heroImg from "@/public/brand/login-hero.webp";

export function SwirlBackground() {
  return (
    <Image
      src={heroImg}
      alt=""
      fill
      priority
      sizes="(min-width: 1024px) 60vw, 0px"
      className="object-cover"
      placeholder="blur"
    />
  );
}
