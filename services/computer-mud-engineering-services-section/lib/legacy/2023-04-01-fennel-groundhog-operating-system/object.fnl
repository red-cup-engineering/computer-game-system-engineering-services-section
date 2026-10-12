(local util (require :util))

(util.clone-table
 (require :thing)
 {:name :object
  :description "This is an object"
  :size 1})
