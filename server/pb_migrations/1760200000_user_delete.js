/** A signed-in person can delete their own account. Plays and playbooks
 *  already cascade-delete through the owner relation. */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.deleteRule = null
    app.save(users)
  },
)
