interface Props {
  size?: "sm" | "md" | "lg";
  withDot?: boolean;
}

export default function BrandMark({ size = "md", withDot = true }: Props) {
  const textCls = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl sm:text-3xl",
  }[size];
  const dotCls = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  }[size];

  return (
    <div className="inline-flex items-center gap-2">
      {withDot && (
        <span
          className={`${dotCls} bg-green-500 rounded-sm led-live`}
          aria-hidden
        />
      )}
      <span className={`brand-mark font-bold text-gray-900 ${textCls}`}>
        exam<span className="text-green-600">shield</span>
      </span>
    </div>
  );
}
