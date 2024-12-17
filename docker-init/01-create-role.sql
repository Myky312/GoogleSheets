DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sheetuser') THEN
      CREATE ROLE sheetuser WITH LOGIN PASSWORD '5675';
   END IF;
END
$$;
