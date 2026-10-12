(local util (require :util))

(local projects {:catalog {}})

(fn projects.load [projects]
  (set projects.catalog (util.load-folder :data/projects)))

(fn projects.save-project [projects project]
  (util.save-file project (.. :data/projects/ project.id)))

(fn projects.save [projects]
  (each [_ project (pairs projects.catalog)]
    (projects:save-project project)))

(fn projects.make-project [projects id ?details]
  (let [project (or ?details {})]
    (set project.id id)
    (when (not project.operations)
      (set project.operations {}))
    (projects:save project)))

(fn projects.collect-tasks [projects ?todo]
  (let [tasks []]
    (each [_ project (pairs projects)]
      (each [_ operation (pairs project.tasks)]
        (table.insert tasks task)))))

projects
