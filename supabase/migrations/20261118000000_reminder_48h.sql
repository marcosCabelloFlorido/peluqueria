alter table settings alter column reminder_hours_before set default 48;
update settings set reminder_hours_before = 48;
