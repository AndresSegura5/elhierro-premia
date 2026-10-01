import Link from "next/link";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main>
        <section className="not-found">
          <p className="eyebrow">No encontrado</p>
          <h1>Este bono o página no existe.</h1>
          <p>Comprueba el código del QR o vuelve al panel para revisar los bonos generados.</p>
          <Link href="/" className="button">
            Volver al inicio
          </Link>
        </section>
      </main>
    </>
  );
}
