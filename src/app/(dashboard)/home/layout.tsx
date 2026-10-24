import { SectionI18nProvider } from "@/i18n/SectionI18nProvider";
import sectionNamespaces from "@/i18n/routeNamespaces.generated.json";

export default function HomeRouteLayout({ children }: { children: React.ReactNode }) {
  return <SectionI18nProvider namespaces={sectionNamespaces.home}>{children}</SectionI18nProvider>;
}
