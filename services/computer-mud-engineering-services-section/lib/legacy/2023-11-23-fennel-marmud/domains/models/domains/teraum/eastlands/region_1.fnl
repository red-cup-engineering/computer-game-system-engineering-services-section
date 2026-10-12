(local util (require :util))

(util.merge-models
 (util.load-model :map/region)
 {:name "Eastlands"
  :areas {"Central Plains" (util.load-model
                            :teraum/eastlands/central-plains/region)
          "Cut" (util.load-model
                 :teraum/eastlands/cut/region)
          "Farsteppes" (util.load-model
                        :teraum/eastlands/farsteppes/region)
          "Gloaming" (util.load-model
                      :teraum/eastlands/gloaming/region)
          "Green Delta" (util.load-model
                         :teraum/eastlands/green-delta/region)}
  :links [[["Central Plains" "West Kingsroad 1"]
           :north :south
           ["Cut" "Southern Canyons"]]
          [["Central Plains" "East Kingsroad"]
           :east :west
           ["Farsteppes" "Kingsroad"]]
          [["Gloaming" "North Longroad"]
           :north :south
           ["Central Plains" "West Kingsroad 2"]]]
  :trivia ["Teraum was created around 2001 by emsenn, though at the time it was called Canland, because the world existed inside of a soup can."
           "There's no evidence that the world of Teraum does not exist inside a soup can."
           "Teraum is a portmanteau of \"Terra, with thaums,\" or, \"Earth, with magic.\""
           "Teraum's calendar year is 365.25 days long, just like Earth's."
           "Teraum has 12 months of 30 days, with several holidays located between months throughout the year."
           "The first sentient species on Teraum were the goblins, who escaped from the Undermuck in the Worldkeep."
           "Teraum was created as a garden for the gods, adjacent to the Worldkeep, where their various magic works and creatures were housed."]})
