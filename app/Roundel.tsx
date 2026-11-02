/**
 * The roundel, sized by `--d` (the ring's diameter). The bar grows for long names,
 * as it does on platform signs.
 */
export function Roundel({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`roundel ${className}`}>
      <span className="roundel-ring" />
      <span className="roundel-bar">
        <span className="roundel-name">{name}</span>
      </span>
    </span>
  );
}
