;;;; area behaviors

(local util (require :util))

(fn search-area [area term ?matches]
  (let [matches (or ?matches [])]
    (util.search-things-by-term area.contents term matches)
    (util.search-things-by-term area.lookables term matches)
  matches))

{: search-area}
