import DirectionsBusOutlinedIcon from "@mui/icons-material/DirectionsBusOutlined";
import FlightOutlinedIcon from "@mui/icons-material/FlightOutlined";
import LocalCafeOutlinedIcon from "@mui/icons-material/LocalCafeOutlined";
import LocalGroceryStoreOutlinedIcon from "@mui/icons-material/LocalGroceryStoreOutlined";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { Box } from "@mui/material";
import type { ComponentType } from "react";
import { tokens } from "../theme";

const ICONS: Record<string, ComponentType<{ fontSize?: "small" | "medium" }>> = {
  food_drink: LocalCafeOutlinedIcon,
  groceries: LocalGroceryStoreOutlinedIcon,
  transport: DirectionsBusOutlinedIcon,
  shopping: ShoppingBagOutlinedIcon,
  bills: ReceiptLongOutlinedIcon,
  health: MonitorHeartOutlinedIcon,
  entertainment: MovieOutlinedIcon,
  travel: FlightOutlinedIcon,
  other: CategoryOutlinedIcon,
};

export function CategoryIcon({ category }: { category: string }) {
  const Icon = ICONS[category] ?? CategoryOutlinedIcon;
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: 40, height: 40, borderRadius: 3, flexShrink: 0, display: "grid", placeItems: "center",
        bgcolor: tokens[theme.palette.mode].accentSoft, color: "primary.main",
      })}
    >
      <Icon fontSize="small" />
    </Box>
  );
}
