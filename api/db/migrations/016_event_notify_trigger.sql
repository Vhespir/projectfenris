CREATE OR REPLACE FUNCTION notify_new_severe_event()
RETURNS trigger AS $$
BEGIN
  IF NEW.severity IN ('Severe', 'Extreme') THEN
    PERFORM pg_notify('new_event', json_build_object(
      'id',         NEW.id,
      'source',     NEW.source,
      'event_type', NEW.event_type,
      'title',      NEW.title,
      'severity',   NEW.severity
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER disaster_event_notify
AFTER INSERT ON disaster_events
FOR EACH ROW EXECUTE FUNCTION notify_new_severe_event();
