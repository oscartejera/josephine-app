/**
 * KDS Grouping Service
 * Agrupa ticket_lines por ticket y por curso
 */

import type { KDSMonitor, KDSTicketLine, KDSOrder, KDSCourseOrder, ProductAggregation } from './types';
import type { KDSQueryResult } from './query-service';

export class KDSGroupingService {
  groupByTicketAndCourse(
    queryResult: KDSQueryResult,
    monitor: KDSMonitor
  ): KDSOrder[] {
    const { lines, tickets, orderFlags } = queryResult;

    // Group lines by ticket_id
    const ticketGroups = new Map<string, KDSTicketLine[]>();
    lines.forEach(line => {
      if (!ticketGroups.has(line.ticket_id)) {
        ticketGroups.set(line.ticket_id, []);
      }
      ticketGroups.get(line.ticket_id)!.push(line);
    });

    const orders: KDSOrder[] = [];

    // For each ticket, group by course
    ticketGroups.forEach((ticketLines, ticketId) => {
      const ticketInfo = tickets.get(ticketId);
      if (!ticketInfo) return;

      // Group by course
      const courseGroups = new Map<number, KDSTicketLine[]>();
      ticketLines.forEach(line => {
        const course = line.course || 1;
        if (!courseGroups.has(course)) {
          courseGroups.set(course, []);
        }
        courseGroups.get(course)!.push(line);
      });

      // Create course orders
      const courseOrders: KDSCourseOrder[] = [];
      courseGroups.forEach((items, course) => {
        const flagKey = `${ticketId}:${course}`;
        const isMarched = orderFlags.get(flagKey) || false;
        const allItemsReady = items.every(item => 
          monitor.secondary_statuses.includes(item.prep_status)
        );

        courseOrders.push({
          course,
          is_marched: isMarched,
          marched_at: null, // Would need to fetch from flags
          items,
          all_items_ready: allItemsReady,
        });
      });

      // Sort by course
      courseOrders.sort((a, b) => a.course - b.course);

      orders.push({
        ticket_id: ticketId,
        table_name: ticketInfo.table_name,
        table_number: ticketInfo.table_name?.match(/\d+/)?.[0] || null,
        server_name: ticketInfo.server_name,
        opened_at: ticketInfo.opened_at,
        covers: ticketInfo.covers,
        orders: courseOrders,
      });
    });

    // Sort orders by oldest first
    orders.sort((a, b) => 
      new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
    );

    return orders;
  }

  /**
   * Fast food mode: group by product instead of ticket
   */
  groupByProduct(lines: KDSTicketLine[]): ProductAggregation[] {
    const productMap = new Map<string, ProductAggregation>();

    lines.forEach(line => {
      const key = line.item_name;
      
      if (!productMap.has(key)) {
        productMap.set(key, {
          product_name: line.item_name,
          total_quantity: 0,
          pending_quantity: 0,
          preparing_quantity: 0,
          ready_quantity: 0,
        });
      }

      const agg = productMap.get(key)!;
      agg.total_quantity += line.quantity;

      switch (line.prep_status) {
        case 'pending':
          agg.pending_quantity += line.quantity;
          break;
        case 'preparing':
          agg.preparing_quantity += line.quantity;
          break;
        case 'ready':
          agg.ready_quantity += line.quantity;
          break;
      }
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.total_quantity - a.total_quantity);
  }

  /**
   * Aggregate products for sidebar filter panel
   */
  aggregateProducts(lines: KDSTicketLine[]): ProductAggregation[] {
    return this.groupByProduct(lines);
  }
}
