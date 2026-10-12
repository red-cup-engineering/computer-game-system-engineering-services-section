;;;; animated thing behaviors

(local fennel (require :fennel))
(local view (fn [x] (print (fennel.view x))))

(fn animate [thing]
  (if thing.dimension
      (each [_ animation (pairs thing.animations)]
        (let [aproc (. animation 1)
              afreq (or (. animation 2) 1)
              achan (or (. animation 3) 100)]
          (when (<= (math.random 1 100) achan)
            (
            (aproc thing))))
      (print "thing ain't got a dimension")))

{: animate}
             
