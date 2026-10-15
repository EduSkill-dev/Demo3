-- 0065: a club's focus uses the places' kinds by the same keys
-- ("mountaineering" was the clubs' word for "mountains").
update clubs set focus = array_replace(focus, 'mountaineering', 'mountains') where 'mountaineering' = any (focus);
