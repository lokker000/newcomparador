import { ShieldCheck } from "./icons";

/** Marca del producto: escudo-check en el acento + wordmark. */
export default function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShieldCheck width={20} height={20} strokeWidth={2} />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">Verificador SAG</p>
        <p className="text-[11px] text-muted-foreground">Certificación de predios rústicos</p>
      </div>
    </div>
  );
}
