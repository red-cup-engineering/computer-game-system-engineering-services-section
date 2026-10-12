(local util (require :util))

(util.clone-table
 (require :thing)
 {:name :container
  :description "This is a container."
  :contents []})
