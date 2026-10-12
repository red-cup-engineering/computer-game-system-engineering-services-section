(lambda log [thing level message]
  (print (.. level " (from ) " thing.name ": " message)))

{:name :something
 :description "This is a generic thing."
 : log}
