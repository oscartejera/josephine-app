/**
 * POS Floor Maps & Tables Seed Data
 * 3 salas con mesas configuradas
 */

export interface FloorMapSeed {
  id: string;
  location_id: string;
  name: string;
  config_json: {
    width: number;
    height: number;
    background: string | null;
  };
  is_active: boolean;
}

export interface TableSeed {
  id: string;
  floor_map_id: string;
  table_number: string;
  seats: number;
  position_x: number;
  position_y: number;
  shape: 'square' | 'round' | 'rectangle';
  width: number;
  height: number;
  status: 'available';
}

export function getFloorMaps(locationId: string): FloorMapSeed[] {
  return [
    {
      id: `floor-${locationId}-1`,
      location_id: locationId,
      name: 'Sala 1',
      config_json: {
        width: 1200,
        height: 800,
        background: null,
      },
      is_active: true,
    },
    {
      id: `floor-${locationId}-2`,
      location_id: locationId,
      name: 'Sala 2',
      config_json: {
        width: 1200,
        height: 800,
        background: null,
      },
      is_active: true,
    },
    {
      id: `floor-${locationId}-3`,
      location_id: locationId,
      name: 'Sala 3',
      config_json: {
        width: 1200,
        height: 800,
        background: null,
      },
      is_active: true,
    },
  ];
}

export function getTables(locationId: string): TableSeed[] {
  const floorMaps = getFloorMaps(locationId);
  const tables: TableSeed[] = [];

  // Sala 1 - Mesas principales (8 mesas)
  const sala1 = floorMaps[0].id;
  tables.push(
    { id: `table-${locationId}-1`, floor_map_id: sala1, table_number: 'Mesa 1', seats: 4, position_x: 100, position_y: 100, shape: 'square', width: 120, height: 120, status: 'available' },
    { id: `table-${locationId}-2`, floor_map_id: sala1, table_number: 'Mesa 2', seats: 4, position_x: 250, position_y: 100, shape: 'square', width: 120, height: 120, status: 'available' },
    { id: `table-${locationId}-3`, floor_map_id: sala1, table_number: 'Mesa 3', seats: 6, position_x: 400, position_y: 100, shape: 'rectangle', width: 150, height: 120, status: 'available' },
    { id: `table-${locationId}-4`, floor_map_id: sala1, table_number: 'Mesa 4', seats: 2, position_x: 100, position_y: 250, shape: 'round', width: 100, height: 100, status: 'available' },
    { id: `table-${locationId}-5`, floor_map_id: sala1, table_number: 'Mesa 5', seats: 2, position_x: 250, position_y: 250, shape: 'round', width: 100, height: 100, status: 'available' },
    { id: `table-${locationId}-6`, floor_map_id: sala1, table_number: 'Mesa 6', seats: 4, position_x: 400, position_y: 250, shape: 'square', width: 120, height: 120, status: 'available' },
    { id: `table-${locationId}-7`, floor_map_id: sala1, table_number: 'Mesa 7', seats: 8, position_x: 100, position_y: 400, shape: 'rectangle', width: 180, height: 140, status: 'available' },
    { id: `table-${locationId}-8`, floor_map_id: sala1, table_number: 'Mesa 8', seats: 4, position_x: 320, position_y: 400, shape: 'square', width: 120, height: 120, status: 'available' },
  );

  // Sala 2 - Terraza (6 mesas)
  const sala2 = floorMaps[1].id;
  tables.push(
    { id: `table-${locationId}-t1`, floor_map_id: sala2, table_number: 'Terraza 1', seats: 4, position_x: 100, position_y: 100, shape: 'round', width: 110, height: 110, status: 'available' },
    { id: `table-${locationId}-t2`, floor_map_id: sala2, table_number: 'Terraza 2', seats: 4, position_x: 250, position_y: 100, shape: 'round', width: 110, height: 110, status: 'available' },
    { id: `table-${locationId}-t3`, floor_map_id: sala2, table_number: 'Terraza 3', seats: 2, position_x: 400, position_y: 100, shape: 'round', width: 90, height: 90, status: 'available' },
    { id: `table-${locationId}-t4`, floor_map_id: sala2, table_number: 'Terraza 4', seats: 2, position_x: 100, position_y: 250, shape: 'round', width: 90, height: 90, status: 'available' },
    { id: `table-${locationId}-t5`, floor_map_id: sala2, table_number: 'Terraza 5', seats: 6, position_x: 250, position_y: 250, shape: 'rectangle', width: 150, height: 120, status: 'available' },
    { id: `table-${locationId}-t6`, floor_map_id: sala2, table_number: 'Terraza 6', seats: 4, position_x: 420, position_y: 250, shape: 'square', width: 110, height: 110, status: 'available' },
  );

  // Sala 3 - VIP/Privado (4 mesas)
  const sala3 = floorMaps[2].id;
  tables.push(
    { id: `table-${locationId}-v1`, floor_map_id: sala3, table_number: 'VIP 1', seats: 10, position_x: 150, position_y: 150, shape: 'rectangle', width: 200, height: 150, status: 'available' },
    { id: `table-${locationId}-v2`, floor_map_id: sala3, table_number: 'VIP 2', seats: 8, position_x: 400, position_y: 150, shape: 'rectangle', width: 180, height: 140, status: 'available' },
    { id: `table-${locationId}-v3`, floor_map_id: sala3, table_number: 'Privado 1', seats: 12, position_x: 150, position_y: 350, shape: 'rectangle', width: 220, height: 160, status: 'available' },
    { id: `table-${locationId}-v4`, floor_map_id: sala3, table_number: 'Barra VIP', seats: 6, position_x: 420, position_y: 350, shape: 'rectangle', width: 160, height: 100, status: 'available' },
  );

  return tables;
}
