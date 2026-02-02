import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function InviteRedirect() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
  if (!token) return;

  fetch(`http://localhost:4000/invite/${token}`, {
    method: "GET",
    credentials: "include",
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Einladung ungültig");
      }

      const data = await response.json();

      if (data.redirectTo) {
        // Jetzt ist es ein RELATIVER Pfad → bleibt in der SPA!
        navigate(data.redirectTo, { replace: true }); // replace = keine Zurück-Button-Spam
      }
    })
    .catch((err) => {
      console.error("Einladung fehlgeschlagen:", err);
      navigate("/", { replace: true });
    });
}, [token, navigate]);

  return <div>Einladung wird verarbeitet…</div>;
}