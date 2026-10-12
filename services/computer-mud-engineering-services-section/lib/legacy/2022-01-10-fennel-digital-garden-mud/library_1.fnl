(local util (require :util))
(local library (util.clone-table (require :thing)))

(set library.name "the library")
(set library.digital-docs (util.load-data :data/digital-documents))

(set library.search {})
(lambda library.search.topics [query ?section]
  (local section (or ?section library.digital-docs))
  (local matches [])
  (each [_ entry (pairs section)]
    (when entry.topics
      (each [_ topic (pairs entry.topics)]
        (when (= query topic)
          (table.insert matches entry)))))
  matches)
  
library
