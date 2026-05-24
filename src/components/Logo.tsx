import Image from "next/image";

export function Logo({ size = 24, showName = true }: { size?: number; showName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/emblem.svg"
        alt="Slice emblem"
        width={size}
        height={size}
        className="shrink-0"
      />
      {showName && (
        <span
          className="font-semibold text-primary tracking-tight"
          style={{ fontSize: Math.round(size * 0.65) }}
        >
          Slice
        </span>
      )}
    </span>
  );
}
