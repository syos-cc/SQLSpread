CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS general_tabs (
    z                TEXT,
    visibility       TEXT    DEFAULT NULL,
    user_select      BOOLEAN DEFAULT NULL,
    UNIQUE           (z)
);

CREATE TABLE IF NOT EXISTS general_rows (
    y                INT,
    z                TEXT,
    height           TEXT    DEFAULT NULL,
    min_height       TEXT    DEFAULT NULL,
    max_height       TEXT    DEFAULT NULL,
    background_color TEXT    DEFAULT NULL,
    visibility       TEXT    DEFAULT NULL,
    user_select      BOOLEAN DEFAULT NULL,
    UNIQUE           (y,z)
);

CREATE TABLE IF NOT EXISTS general_columns (
    x                TEXT,
    z                TEXT,
    width            TEXT    DEFAULT NULL,
    min_width        TEXT    DEFAULT NULL,
    max_width        TEXT    DEFAULT NULL,
    background_color TEXT    DEFAULT NULL,
    visibility       TEXT    DEFAULT NULL,
    user_select      BOOLEAN DEFAULT NULL,
    UNIQUE           (x,z)
);

CREATE TABLE IF NOT EXISTS data (
    x                TEXT,
    y                INT,
    z                TEXT,
    value_type       TEXT    DEFAULT 'TEXT',
    value_text       TEXT    DEFAULT '',
    value_integer    INTEGER DEFAULT NULL,
    value_real       REAL    DEFAULT NULL,
    value_blob       BLOB    DEFAULT NULL,
    padding          TEXT    DEFAULT NULL,
    border           TEXT    DEFAULT NULL,
    border_top       TEXT    DEFAULT NULL,
    border_right     TEXT    DEFAULT NULL,
    border_bottom    TEXT    DEFAULT NULL,
    border_left      TEXT    DEFAULT NULL,
    background_color TEXT    DEFAULT NULL,
    box_shadow       TEXT    DEFAULT NULL,
    text_align       TEXT    DEFAULT NULL,
    vertical_align   TEXT    DEFAULT NULL,
    font             TEXT    DEFAULT NULL,
    font_weight      TEXT    DEFAULT NULL,
    color            TEXT    DEFAULT NULL,
    white_space      TEXT    DEFAULT NULL,
    overflow         TEXT    DEFAULT NULL,
    text_overflow    TEXT    DEFAULT NULL,
    display          TEXT    DEFAULT NULL,
    visibility       TEXT    DEFAULT NULL,
    opacity          TEXT    DEFAULT NULL,
    cursor           TEXT    DEFAULT NULL,
    user_select      BOOLEAN DEFAULT NULL,
    notice           TEXT    DEFAULT '',
    UNIQUE           (x,y,z)
);

CREATE TRIGGER trg_januar_weekend_insert
AFTER INSERT ON data
FOR EACH ROW
WHEN NEW.z = 'Januar'
 AND UPPER(NEW.x) = 'B'
 AND NEW.value_type = 'TEXT'
 AND NEW.value_text IN ('Samstag', 'Sonntag')
BEGIN
    UPDATE general_rows
       SET background_color = '#fff8cc'
     WHERE z = 'Januar'
       AND y = NEW.y;
END;

CREATE TRIGGER trg_januar_weekend_update
AFTER UPDATE OF value_text, value_type, x, y, z ON data
FOR EACH ROW
WHEN NEW.z = 'Januar'
 AND UPPER(NEW.x) = 'B'
 AND NEW.value_type = 'TEXT'
 AND NEW.value_text IN ('Samstag', 'Sonntag')
BEGIN
    UPDATE general_rows
       SET background_color = '#fff8cc'
     WHERE z = 'Januar'
       AND y = NEW.y;
END;

CREATE TRIGGER trg_januar_weekday_reset
AFTER UPDATE OF value_text, value_type, x, y, z ON data
FOR EACH ROW
WHEN NEW.z = 'Januar'
 AND UPPER(NEW.x) = 'B'
 AND NEW.value_type = 'TEXT'
 AND NEW.value_text NOT IN ('Samstag', 'Sonntag')
BEGIN
    UPDATE general_rows
       SET background_color = '#ffffff'
     WHERE z = 'Januar'
       AND y = NEW.y;
END;

INSERT INTO general_tabs (z)
    VALUES
        ('Januar')
;

INSERT INTO general_columns (x,z)
    VALUES
        ('A','Januar'),
        ('B','Januar')
;

INSERT INTO general_rows (y,z)
    VALUES
        (1,'Januar'),
        (2,'Januar'),   
        (3,'Januar'),
        (4,'Januar'),
        (5,'Januar'),   
        (6,'Januar'),
        (7,'Januar'),
        (8,'Januar'),   
        (9,'Januar'),
        (10,'Januar'),
        (11,'Januar'),   
        (12,'Januar'),
        (13,'Januar'),
        (14,'Januar'),   
        (15,'Januar'),
        (16,'Januar'),
        (17,'Januar'),   
        (18,'Januar'),
        (19,'Januar'),
        (20,'Januar'),   
        (21,'Januar'),
        (22,'Januar'),
        (23,'Januar'),   
        (24,'Januar'),
        (25,'Januar'),
        (26,'Januar'),   
        (27,'Januar'),
        (28,'Januar'),
        (29,'Januar'),   
        (30,'Januar'),
        (31,'Januar')
;

INSERT INTO data (x,y,z,value_type,value_integer)
    VALUES
        ('a',2,'Januar','INTEGER',1),
        ('a',3,'Januar','INTEGER',2),
        ('a',4,'Januar','INTEGER',3),
        ('a',5,'Januar','INTEGER',4),
        ('a',6,'Januar','INTEGER',5),
        ('a',7,'Januar','INTEGER',6),
        ('a',8,'Januar','INTEGER',7),
        ('a',9,'Januar','INTEGER',8),
        ('a',10,'Januar','INTEGER',9),
        ('a',11,'Januar','INTEGER',10),
        ('a',12,'Januar','INTEGER',11),
        ('a',13,'Januar','INTEGER',12),
        ('a',14,'Januar','INTEGER',13),
        ('a',15,'Januar','INTEGER',14),
        ('a',16,'Januar','INTEGER',15),
        ('a',17,'Januar','INTEGER',16),
        ('a',18,'Januar','INTEGER',17),
        ('a',19,'Januar','INTEGER',18),
        ('a',20,'Januar','INTEGER',19),
        ('a',21,'Januar','INTEGER',20),
        ('a',22,'Januar','INTEGER',21),
        ('a',23,'Januar','INTEGER',22),
        ('a',24,'Januar','INTEGER',23),
        ('a',25,'Januar','INTEGER',24),
        ('a',26,'Januar','INTEGER',25),
        ('a',27,'Januar','INTEGER',26),
        ('a',28,'Januar','INTEGER',27),
        ('a',29,'Januar','INTEGER',28),
        ('a',30,'Januar','INTEGER',29),
        ('a',31,'Januar','INTEGER',30),
        ('a',32,'Januar','INTEGER',31)
;



INSERT INTO data (x,y,z,value_type,value_text)
    VALUES
        ('a',1,'Januar','TEXT','Tag'),
        ('b',1,'Januar','TEXT','Wochentag'),
        ('b',2,'Januar','TEXT','Donnerstag'),
        ('b',3,'Januar','TEXT','Freitag'),
        ('b',4,'Januar','TEXT','Samstag'),
        ('b',5,'Januar','TEXT','Sonntag'),
        ('b',6,'Januar','TEXT','Montag'),
        ('b',7,'Januar','TEXT','Dienstag'),
        ('b',8,'Januar','TEXT','Mittwoch'),
        ('b',9,'Januar','TEXT','Donnerstag'),
        ('b',10,'Januar','TEXT','Freitag'),
        ('b',11,'Januar','TEXT','Samstag'),
        ('b',12,'Januar','TEXT','Sonntag'),
        ('b',13,'Januar','TEXT','Montag'),
        ('b',14,'Januar','TEXT','Dienstag'),
        ('b',15,'Januar','TEXT','Mittwoch'),
        ('b',16,'Januar','TEXT','Donnerstag'),
        ('b',17,'Januar','TEXT','Freitag'),
        ('b',18,'Januar','TEXT','Samstag'),
        ('b',19,'Januar','TEXT','Sonntag'),
        ('b',20,'Januar','TEXT','Montag'),
        ('b',21,'Januar','TEXT','Dienstag'),
        ('b',22,'Januar','TEXT','Mittwoch'),
        ('b',23,'Januar','TEXT','Donnerstag'),
        ('b',24,'Januar','TEXT','Freitag'),
        ('b',25,'Januar','TEXT','Samstag'),
        ('b',26,'Januar','TEXT','Sonntag'),
        ('b',27,'Januar','TEXT','Montag'),
        ('b',28,'Januar','TEXT','Dienstag'),
        ('b',29,'Januar','TEXT','Mittwoch'),
        ('b',30,'Januar','TEXT','Donnerstag'),
        ('b',31,'Januar','TEXT','Freitag'),
        ('b',32,'Januar','TEXT','Samstag')
;
