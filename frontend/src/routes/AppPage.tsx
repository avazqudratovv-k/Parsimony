import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { meQuery } from "../api/auth";
import { DemoBanner } from "../components/DemoBanner";
import { TopBar } from "../components/TopBar";
import { useT } from "../i18n";

// Placeholder: Day 8 replaces this with the add bar, entry list and "Fix this".
export function AppPage() {
  const t = useT();
  const { data: user } = useQuery(meQuery);

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {user?.is_demo && <DemoBanner />}
      <TopBar />
      <Box component="main" sx={{ p: { xs: 4, sm: 8 } }}>
        <Typography variant="h1" component="h1" sx={{ mb: 2 }}>{t("app.title")}</Typography>
        <Typography color="text.secondary">{user?.email}</Typography>
        <Typography color="text.secondary" sx={{ mt: 4 }}>{t("app.placeholder")}</Typography>
      </Box>
    </Box>
  );
}
