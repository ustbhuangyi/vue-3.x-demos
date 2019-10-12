const STORAGE_KEY = 'todos-vuejs-3.x'
export const todoStorage = {
  fetch () {
    const todos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    todos.forEach((todo, index) => {
      todo.id = index
    })
    todoStorage.uid = todos.length
    return todos
  },
  save (todos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }
}

export const filters = {
  all (todos) {
    return todos
  },
  active (todos) {
    return todos.filter((todo) => {
      return !todo.completed
    })
  },
  completed (todos) {
    return todos.filter(function (todo) {
      return todo.completed
    })
  }
}

export function pluralize (n) {
  return n === 1 ? 'item' : 'items'
}
