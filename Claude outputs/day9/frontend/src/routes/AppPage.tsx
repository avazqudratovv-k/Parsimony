import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { meQuery } from "../api/auth";
import { AddBar } from "../components/AddBar";
import { DemoBanner } from "../components/DemoBanner";
import { EntryList } from "../components/EntryList";
import { MonthChart } from "../components/MonthChart";
import { TopBar } from "../components/TopBar";
import { currentMonth } from "../lib/format";
import { useT } from "../i18n";

// The dashboard: add bar, this month's chart, and the list for the same month.
export function AppPage() {
  const t = useT();
  const { data: user } = useQuery(meQuery);
  const timeZone = user?.timezone ?? "UTC";
  const thisMonth = currentMonth(timeZone);
  const [picked, setPicked] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const month = picked ?? thisMonth;

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {user?.is_demo && <DemoBanner />}
      <TopBar />
      <Box component="main" sx={{ flex: 1, width: "100%", maxWidth: 720, mx: "auto", px: { xs: 4, sm: 6 }, pt: { xs: 5, sm: 8 }, pb: { xs: 32, sm: 12 } }}>
        <Typography variant="h1" component="h1" sx={{ mb: { xs: 3, sm: 5 } }}>{t("app.title")}</Typography>
        {/* On phones the bar docks itself to the bottom of the screen; on desktop it sits here. */}
        {/* A new entry is dated today, so after adding we show the current month. */}
        <AddBar onAdded={() => setPicked(null)} />
        <MonthChart
          month={month}
          currency={currency}
          timeZone={timeZone}
          onMonth={(m) => { setPicked(m >= thisMonth ? null : m); setCurrency(null); }}
          onCurrency={setCurrency}
        />
        <EntryList month={month} isCurrentMonth={month === thisMonth} />
      </Box>
    </Box>
  );
}
