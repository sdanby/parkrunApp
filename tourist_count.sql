-- tourist count

select event_code,count(*)
from eventpositions_view
where formatted_date = '2025-08-30' 
  and tourist_flag='T'
group by event_code