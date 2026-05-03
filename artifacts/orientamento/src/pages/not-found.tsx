import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl border p-8 text-center">
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{t("notFound.title")}</h1>
        <p className="text-sm text-gray-600 mb-6">{t("notFound.subtitle")}</p>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          {t("notFound.goHome")}
        </Link>
      </div>
    </div>
  );
}
