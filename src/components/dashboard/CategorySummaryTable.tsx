import type { CategorySummary } from "@/lib/menu-totals";
import { formatNumber } from "@/lib/format";
import { MetricValue } from "@/components/dishes/Metric";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function CategorySummaryTable({ categories }: { categories: CategorySummary[] }) {
  return (
    <section className="surface">
      <header className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">Kategorien</h2>
        <p className="text-xs text-muted-foreground">Quoten gewichtet nach Geldsummen der Kategorie.</p>
      </header>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategorie</TableHead>
              <TableHead className="text-right">Erw. Verkäufe</TableHead>
              <TableHead className="text-right">Nettoumsatz</TableHead>
              <TableHead className="text-right">Wareneinsatz</TableHead>
              <TableHead className="text-right">Gesamt-DB I</TableHead>
              <TableHead className="text-right">Anteil</TableHead>
              <TableHead className="text-right">WE-Quote</TableHead>
              <TableHead className="text-right">DB-I-Marge</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">Keine einbezogenen Positionen.</TableCell></TableRow>
            )}
            {categories.map((c) => (
              <TableRow key={c.categoryId ?? c.categoryName}>
                <TableCell className="font-medium">{c.categoryName}<span className="ml-2 text-xs text-muted-foreground">{c.lines} Pos.</span></TableCell>
                <TableCell className="tabular text-right">{formatNumber(c.expectedSales, Number.isInteger(c.expectedSales) ? 0 : 1)}</TableCell>
                <TableCell className="text-right"><MetricValue value={c.netRevenue} kind="chf" /></TableCell>
                <TableCell className="text-right"><MetricValue value={c.foodCost} kind="chf" /></TableCell>
                <TableCell className="text-right font-medium"><MetricValue value={c.contributionMargin1} kind="chf" /></TableCell>
                <TableCell className="text-right"><MetricValue value={c.share} kind="percent" /></TableCell>
                <TableCell className="text-right"><MetricValue value={c.foodCostRatio} kind="percent" /></TableCell>
                <TableCell className="text-right"><MetricValue value={c.contributionMarginRatio} kind="percent" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
