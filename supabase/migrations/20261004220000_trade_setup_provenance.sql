-- Nur neue Zeilen erhalten Herkunft; NULL in historischen Zeilen bedeutet unbekannt.
ALTER TABLE public.trade_setups
  ADD COLUMN source text CHECK (source IN ('live', 'backfill', 'rebuild', 'manual')),
  ADD COLUMN detector_version text,
  ADD COLUMN config_hash text,
  ADD COLUMN input_set_id text;

-- Ein Konflikt-Upsert darf alte Herkunft nicht nachträglich aus dem heutigen Writer erraten.
CREATE FUNCTION public.preserve_trade_setup_provenance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.source := OLD.source;
  NEW.detector_version := OLD.detector_version;
  NEW.config_hash := OLD.config_hash;
  NEW.input_set_id := OLD.input_set_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER preserve_trade_setup_provenance
BEFORE UPDATE OF source, detector_version, config_hash, input_set_id ON public.trade_setups
FOR EACH ROW EXECUTE FUNCTION public.preserve_trade_setup_provenance();
