-- Fix the trigger that references invalid enum value 'void'
CREATE OR REPLACE FUNCTION sync_pos_table_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When ticket is closed, mark table as available
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' AND NEW.pos_table_id IS NOT NULL THEN
    UPDATE pos_tables SET status = 'available', current_ticket_id = NULL
    WHERE id = NEW.pos_table_id;
  END IF;
  
  -- When ticket is opened, mark table as occupied
  IF NEW.status = 'open' AND OLD.status IS DISTINCT FROM 'open' AND NEW.pos_table_id IS NOT NULL THEN
    UPDATE pos_tables SET status = 'occupied', current_ticket_id = NEW.id
    WHERE id = NEW.pos_table_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;