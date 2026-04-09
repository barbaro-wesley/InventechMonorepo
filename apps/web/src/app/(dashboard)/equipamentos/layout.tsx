import { Suspense, type ReactNode } from "react";

export default function EquipamentosLayout({ children }: { children: ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
