import { Box, Button, Typography } from "@mui/material";
import { useT } from "../i18n";

// Shown by the router when a screen crashes while rendering. Plain, translated, with a way out.
export function ErrorScreen() {
  const t = useT();
  return (
    <Box role="alert" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center", p: 4 }}>
      <Box>
        <Typography variant="h1" component="h1" sx={{ mb: 2 }}>{t("error.title")}</Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>{t("error.body")}</Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>{t("error.reload")}</Button>
      </Box>
    </Box>
  );
}
