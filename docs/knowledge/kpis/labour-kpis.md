# Labour KPIs — Restaurant Operations

> Source: Industry standards + EHL Workforce Management
> Agent: Reference when building scheduling, labour analytics, or workforce features

## Primary Labour KPIs

### Cost Metrics
- **Labour Cost %** = Total Labour Cost / Revenue × 100 | Target: 25-32%
- **Labour Cost per Cover** = Total Labour Cost / Covers
- **Overtime %** = Overtime Hours / Total Hours × 100 | Target: < 5%
- **Benefits Load %** = Total Benefits Cost / Total Labour Cost × 100

### Productivity Metrics
- **Sales Per Labour Hour (SPLH)** = Revenue / Total Labour Hours | **Key efficiency metric**
- **Covers Per Labour Hour (CPLH)** = Covers / Total Labour Hours
- **Revenue Per FTE** = Revenue / Full-Time Equivalents
- **Labour Efficiency Ratio** = Actual SPLH / Target SPLH

### Scheduling Metrics
- **Schedule Adherence %** = Actual Hours / Scheduled Hours × 100 | Target: 95-100%
- **Schedule vs Actual Variance** = (Actual - Scheduled) / Scheduled × 100
- **Staffing Ratio** = Staff on Shift / Expected Covers

### Retention Metrics
- **Turnover Rate** = Separations / Average Headcount × 100 | Industry avg: 60-80%/yr
- **Cost Per Hire** = Total Recruitment Cost / New Hires
- **Training Cost Per Employee** = Total Training Spend / Headcount
- **90-Day Retention %** = Employees Retained at 90 Days / New Hires

## Scheduling Best Practices (EHL)

### Demand-Based Scheduling
1. **Forecast covers** using historical data + events + weather
2. **Calculate required labour hours** by daypart
3. **Assign shifts** matching skill requirements × demand peaks
4. **Monitor actuals vs forecast** → refine model

### Optimal Staffing Model
```
Required Staff = (Forecasted Covers × Service Minutes per Cover) / (Shift Length × 60)
```

### Cross-Training Value
- Reduces need for overstaffing by 10-15%
- Increases schedule flexibility
- Improves employee engagement and retention

## Josephine Implementation Map

| KPI | Where in Josephine | Hook/RPC |
|-----|-------------------|----------|
| Labour Cost % | Labour.tsx, Dashboard | useLabourData |
| SPLH | Labour.tsx | useLabourData |
| Schedule vs Actual | Scheduling.tsx | useSchedulingSupabase |
| Overtime tracking | Not yet | — |
| Turnover Rate | Not yet | — |
| Schedule Efficiency | Scheduling.tsx | useScheduleEfficiency |

## Missing Features (Roadmap)
- Overtime alerts when approaching 5% threshold
- Turnover tracking dashboard
- Cost-per-cover by department view
- AI scheduling recommendations based on SPLH targets
