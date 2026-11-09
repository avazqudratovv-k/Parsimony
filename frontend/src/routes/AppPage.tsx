import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { meQuery } from "../api/auth";
import { AddBar } from "../components/AddBar";
import { DemoBanner } from "../components/DemoBanner";
import { EntryList } from "../components/EntryList";
import { TopBar } from "../components/TopBar";
import { useT } from "../i18n";

// The dashboard. Day 9 adds the monthly chart above the list.
export function AppPage() {
  const t = useT();
  const { data: user } = useQuery(meQuery);

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {user?.is_demo && <DemoBanner />}
      <TopBar />
      <Box component="main" sx={{ flex: 1, width: "100%", maxWidth: 720, mx: "auto", px: { xs: 4, sm: 6 }, pt: { xs: 5, sm: 8 }, pb: { xs: 32, sm: 12 } }}>
        <Typography variant="h1" component="h1" sx={{ mb: { xs: 3, sm: 5 } }}>{t("app.title")}</Typography>
        {/* On phones the bar docks itself to the bottom of the screen; on desktop it sits here. */}
        <AddBar />
        <EntryList />
      </Box>
    </Box>
  );
}
