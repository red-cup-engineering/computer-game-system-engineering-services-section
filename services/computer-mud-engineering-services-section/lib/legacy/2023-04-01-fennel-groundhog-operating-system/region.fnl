(local util (require :util))

(util.clone-table
 (require :thing)
 {:name :region
  :description "This is a region."
  :areas []
  :links []
  :fill
  (fn [region areas]
    (each [_ area (pairs areas)]
      (tset region.areas area (require (.. :data/map/ area)))))
  :link
  (fn [region links]
    nil)
  :load
  (fn [region details]
    (when details.name (set region.name details.name))
    (when details.areas (region:fill details.areas))
    (when details.links (region:link details.links)))})
