;;;; region behaviors

(local util (require :util))

(fn ld [region dimension]
  (each [_ model (pairs region.area-list)]
    (tset region.areas model (util.make-model model))
    (let [area (. region.areas model)]
      (when area.lookables
        (each [num lookable-model (pairs area.lookables)]
          (let [lookable (dimension:make-model :lookable lookable-model)]
            (tset area.lookables num lookable))))))
  (set region.loaded? true))

(fn find-area [region id]
  (local matches [])
  (each [aid area (pairs region.areas)]
    (when (= aid id)
      (table.insert matches area)))
  (. matches 1))

{:load ld
 : find-area}
