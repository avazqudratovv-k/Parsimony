import { Box } from "@mui/material";
import { Link } from "@tanstack/react-router";
import { useT } from "../i18n";

/** The app icon: green rounded square with an italic "p." (outlined, so no font is needed). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return <Box component="img" src="/icon.svg" alt="" width={size} height={size} sx={{ display: "block" }} />;
}

/** Icon + the wordmark, as a link home. The wordmark is live text in Newsreader Italic. */
export function Wordmark({ size = 32 }: { size?: number }) {
  const t = useT();
  return (
    <Box
      component={Link}
      to="/"
      aria-label="Parsimony"
      sx={{ display: "inline-flex", alignItems: "center", gap: 2.5, textDecoration: "none", color: "inherit", borderRadius: 2 }}
    >
      <LogoMark size={size} />
      <Box
        component="span"
        aria-hidden
        sx={{ fontFamily: '"Newsreader", serif', fontStyle: "italic", fontWeight: 500, fontSize: size * 0.8, lineHeight: 1, color: "text.primary" }}
      >
        {t("brand.name")}
        <Box component="span" sx={{ color: "primary.main" }}>.</Box>
      </Box>
    </Box>
  );
}
