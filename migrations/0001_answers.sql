-- Every answer: one per player per prompt. An empty station_id means the player ran out of time.
CREATE TABLE answers (
  day TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  player TEXT NOT NULL,
  station_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, prompt_id, player)
);

-- How many players gave each answer. Scoring reads these few rows instead of every answer.
CREATE TABLE tallies (
  day TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  players INTEGER NOT NULL,
  PRIMARY KEY (day, prompt_id, station_id)
);

CREATE TRIGGER tally_answer AFTER INSERT ON answers
BEGIN
  INSERT OR IGNORE INTO tallies (day, prompt_id, station_id, players) VALUES (NEW.day, NEW.prompt_id, NEW.station_id, 0);
  UPDATE tallies SET players = players + 1
  WHERE day = NEW.day AND prompt_id = NEW.prompt_id AND station_id = NEW.station_id;
END;
