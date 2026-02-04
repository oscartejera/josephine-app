# Sales Module - Complete Implementation Plan

## 🎯 Based on Nory Screenshots

### Current Status:
- ✅ Simple version (3 cards + 1 chart)
- ❌ Missing: 4 major sections

### To Implement (Next Session):

## 1. Enhanced KPI Cards

**Sales to Date Card:**
```typescript
<Card>
  <CardHeader>
    <div className="flex justify-between">
      <span>Sales to Date</span>
      <span className="text-sm">29 Sep - 1 Oct</span>
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-4xl font-bold">€36,066</div>
    <VarianceIndicator value={0.94} label="vs forecast" />
    
    {/* Channel Bars */}
    <div className="mt-4 space-y-2">
      <ChannelBar color="indigo" label="Dine-in" percentage={62} />
      <ChannelBar color="sky" label="Pick-up" percentage={8} />
      <ChannelBar color="cyan" label="Delivery" percentage={30} />
    </div>
  </CardContent>
</Card>
```

## 2. Channel Breakdown Table

```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Channel</TableHead>
      <TableHead>Actual (29 Sep - 1 Oct)</TableHead>
      <TableHead>Projected (29 Sep - 5 Oct)</TableHead>
      <TableHead>Avg Check (Actual)</TableHead>
      <TableHead>Avg Check (Projected)</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <ChannelRow 
      channel="Dine-in"
      actual={22330}
      actualVar={0.9}
      projected={71845}
      projVar={0.28}
      avgCheckActual={24.84}
      avgCheckActualVar={8.35}
      avgCheckProj={26.85}
      avgCheckProjVar={2.77}
    />
    {/* Pick-up, Delivery rows */}
    <TotalRow /> {/* SUM y AVG */}
  </TableBody>
</Table>
```

## 3. Product Categories

**Stacked Bar Chart:**
```typescript
<BarChart data={categoryData}>
  <Bar dataKey="food" stackId="a" fill="#6366f1" />
  <Bar dataKey="beverage" stackId="a" fill="#0ea5e9" />
  <Bar dataKey="other" stackId="a" fill="#cbd5e1" />
</BarChart>

Table:
Food      | 94.76% | €32,740
Beverage  | 5.24%  | €1,811  
Other     | 0%     | €0
```

## 4. Products Performance Table

```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Product Name</TableHead>
      <TableHead className="text-right">Value</TableHead>
      <TableHead className="text-right">% of sales</TableHead>
      <TableHead>↓</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {products.map(p => (
      <TableRow>
        <TableCell>{p.name}</TableCell>
        <TableCell className="text-right">€{p.value}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center gap-2">
            <span>{p.pct}%</span>
            <div className="flex-1 h-2 bg-gray-100 rounded">
              <div 
                className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded"
                style={{ width: `${p.pct * 5}%` }}
              />
            </div>
          </div>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## 5. Sales by Location Rollup

```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Locations ↑</TableHead>
      <TableHead colSpan={2}>Sales</TableHead>
      <TableHead colSpan={3}>Channels</TableHead>
      <TableHead colSpan={3}>Other</TableHead>
    </TableRow>
    <TableRow>
      <TableHead></TableHead>
      <TableHead>Actual</TableHead>
      <TableHead>Forecasted</TableHead>
      <TableHead>Dine-in</TableHead>
      <TableHead>Delivery</TableHead>
      <TableHead>Pick-up</TableHead>
      <TableHead>Orders</TableHead>
      <TableHead>ACS</TableHead>
      <TableHead>Dwell</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {locations.map(loc => (
      <LocationRow 
        name={loc.name}
        actual={loc.actual}
        actualVar={loc.variance}
        forecasted={loc.forecast}
        // ... all columns
      />
    ))}
    <TotalsRow /> {/* SUM for totals, AVG for averages */}
  </TableBody>
</Table>
```

## 6. Backend Queries

**Get Sales Data:**
```typescript
const getSalesData = async (startDate, endDate, locationId) => {
  // Aggregate facts_sales_15m
  const { data } = await supabase
    .from('facts_sales_15m')
    .select('*')
    .eq('location_id', locationId)
    .gte('ts_bucket', startDate)
    .lte('ts_bucket', endDate);

  // Aggregate by day
  const daily = aggregateToDaily(data);
  
  // Get forecast
  const { data: forecast } = await supabase
    .from('ai_forecasts')
    .select('*')
    .eq('location_id', locationId)
    .eq('metric', 'sales')
    .gte('horizon_start', endDate); // Future

  return { actual: daily, forecast };
};
```

## Components to Create:

1. `ChannelBar.tsx` - Visual bar for percentages
2. `ChannelRow.tsx` - Table row with variance
3. `ProductRow.tsx` - Row with inline bar
4. `LocationRow.tsx` - Multi-column row
5. `DateRangePicker.tsx` - Full date picker
6. `CompareSelector.tsx` - Dropdown

## Estimated:
- ~1000 lines of code
- 3-4 hours work
- 5-8 commits

---

Ready to implement in next session.
