{:crochet-pattern
     {:created-by [:string "Who made the pattern"]
      :status [[:string-seq] "Status of the pattern."
               [:complete :untranscribed]]
      :source [:string "Where did the pattern come from?"]
      :product [:string "What is the result of following the pattern?"]
      :notes [:string-seq "List of notes associated with the pattern."]
      :materials [:sequence "Sequence of material listings, three-part sequence of material, quantity, and unit."]
      :tools [:string-seq "List of IDs of tools needed for the thing."]
      :pattern [:sequence "Complex sequence serializing the crochet pattern. TBD"]
      :stitches [:string-seq "List of stitches used in this pattern."]}}
