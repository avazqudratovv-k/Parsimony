import { Box, Typography, useMediaQuery } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { meQuery } from "../api/auth";
import { useEntries, useMonthlyStats } from "../api/entries";
import { AddBar } from "../components/AddBar";
import { CategoryChart } from "../components/CategoryChart";
import { DemoBanner } from "../components/DemoBanner";
import { ExportMenu } from "../components/ExportMenu";
import { EntryList } from "../components/EntryList";
import { FixDialog } from "../components/FixDialog";
import { MonthReceipt } from "../components/MonthReceipt";
import { NeedsCheck } from "../components/NeedsCheck";
import { PeriodControls } from "../components/PeriodControls";
import { TopBar } from "../components/TopBar";
import { currentMonth, shiftMonth } from "../lib/format";
import { useT } from "../i18n";
import { DESKTOP } from "../theme";

const LAST_OPENED = "parsimony.lastMonthOpened";

// The dashboard. Phones: controls, chart, day-grouped list, add bar docked at the bottom.
// Desktop (1024px and up): add bar and list on the left, sticky chart and "Needs a check" on the right.
export function AppPage() {
  const t = useT();
  const desktop = useMediaQuery(DESKTOP);
  const { data: user } = useQuery(meQuery);
  const timeZone = user?.timezone ?? "UTC";
  const thisMonth = currentMonth(timeZone);
  const [picked, setPicked] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [receiptMonth, setReceiptMonth] = useState<string | null>(null);
  const month = picked ?? thisMonth;

  // The first time the app opens in a new month, the month that just closed is printed as a receipt, once.
  useEffect(() => {
    if (!user) return;
    try {
      const seen = localStorage.getItem(LAST_OPENED);
      if (seen && seen < thisMonth) setReceiptMonth(shiftMonth(thisMonth, -1));
      if (seen !== thisMonth) localStorage.setItem(LAST_OPENED, thisMonth);
    } catch {
      /* storage can be blocked; then there is just no receipt */
    }
  }, [user, thisMonth]);

  const entries = useEntries(month);
  const stats = useMonthlyStats(month, currency);
  const previous = useMonthlyStats(shiftMonth(month, -1), stats.data?.currency ?? null, !!stats.data);
  const open = entries.data?.find((e) => e.id === openId) ?? null;

  const goToMonth = (m: string) => {
    setPicked(m >= thisMonth ? null : m);
    setCurrency(null);
  };
  const controls = (
    <PeriodControls
      month={month}
      thisMonth={thisMonth}
      onMonth={goToMonth}
      onPrev={() => goToMonth(shiftMonth(month, -1))}
      onNext={() => goToMonth(shiftMonth(month, 1))}
      currencies={stats.data?.currencies ?? []}
      currency={stats.data?.currency ?? currency}
      onCurrency={setCurrency}
    />
  );
  const chart = <CategoryChart month={month} onReceipt={month < thisMonth ? () => setReceiptMonth(month) : undefined} data={stats.data} previous={previous.data} isPending={stats.isPending} isError={stats.isError} />;
  const exporter = entries.data && entries.data.length > 0 ? <ExportMenu month={month} entries={entries.data} /> : null;
  const list = (
    <EntryList query={entries} month={month} isCurrentMonth={month === thisMonth} timeZone={timeZone} onOpen={setOpenId} />
  );

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {user?.is_demo && <DemoBanner />}
      <TopBar center={desktop ? controls : undefined} />
      <Box
        component="main"
        sx={{ flex: 1, width: "100%", maxWidth: desktop ? 1280 : 720, mx: "auto", px: { xs: 4, lg: 8 }, pt: { xs: 3, lg: 8 }, pb: { xs: 32, lg: 12 } }}
      >
        <Typography variant="h1" component="h1" sx={{ position: "absolute", width: "1px", height: "1px", m: "-1px", p: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
          {t("app.title")}
        </Typography>
        {desktop ? (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 8, alignItems: "start" }}>
            <Box>
              <AddBar onAdded={(e) => goToMonth(e ? e.date.slice(0, 7) : thisMonth)} />
              {exporter}
              {list}
            </Box>
            <Box sx={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 4 }}>
              {chart}
              <NeedsCheck entries={entries.data ?? []} onOpen={setOpenId} />
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 3 }}>{controls}</Box>
            {chart}
            <Box sx={{ mt: 4 }}><NeedsCheck entries={entries.data ?? []} onOpen={setOpenId} /></Box>
            {exporter}
            {list}
            <AddBar onAdded={(e) => goToMonth(e ? e.date.slice(0, 7) : thisMonth)} />
          </>
        )}
      </Box>
      {receiptMonth && <MonthReceipt month={receiptMonth} onClose={() => setReceiptMonth(null)} />}
      {open && <FixDialog entry={open} onClose={() => setOpenId(null)} />}
    </Box>
  );
}
