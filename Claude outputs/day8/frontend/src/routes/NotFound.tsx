import { Box, Button, Typography } from "@mui/material";
import { Link } from "@tanstack/react-router";
import { useT } from "../i18n";

export function NotFound() {
  const t = useT();
  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center", p: 4 }}>
      <Box>
        <Typography variant="h1" component="h1" sx={{ mb: 4 }}>{t("notFound.title")}</Typography>
        <Button component={Link} to="/" variant="contained">{t("notFound.back")}</Button>
      </Box>
    </Box>
  );
}
