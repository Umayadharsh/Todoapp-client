import { useState, useEffect, useRef } from "react";

export default function Todos() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [recurring, setRecurring] = useState("None");

  const [todos, setTodos] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(""); // ✅ Success message
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState("Medium");
  const [editRecurring, setEditRecurring] = useState("None");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const apiUrl = "http://localhost:4000";

  // Notification permission
  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Ref to track which tasks are already notified today
  const notifiedTasks = useRef(new Set());

  // Fetch all todos
  useEffect(() => {
    fetch(apiUrl + "/todos")
      .then((res) => res.json())
      .then((data) => setTodos(data))
      .catch(() => setError("Failed to fetch todos"));
  }, []);

  // Notifications for today tasks
  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];

    todos.forEach((todo) => {
      if (!todo.dueDate || todo.status) return;

      const dueStr = new Date(todo.dueDate).toISOString().split("T")[0];

      if (dueStr === todayStr && !notifiedTasks.current.has(todo._id)) {
        new Notification("Reminder", {
          body: `Task due today: ${todo.title}`,
        });
        notifiedTasks.current.add(todo._id);
      }
    });
  }, [todos]);

  // Add todo
  const addTodo = () => {
    if (!title.trim()) {
      setError("Title cannot be empty");
      return;
    }

    fetch(apiUrl + "/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        dueDate,
        priority,
        recurring,
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setTodos([...todos, data]);
          // Reset fields
          setTitle("");
          setDescription("");
          setDueDate("");
          setPriority("Medium");
          setRecurring("None");
          setError("");
          setSuccess("Todo added successfully!"); // ✅ Show success message
          setTimeout(() => setSuccess(""), 3000); // Hide after 3s
        } else {
          setError("Unable to create todo");
        }
      })
      .catch(() => setError("Server not reachable"));
  };

  // Toggle status
  const toggleStatus = (id) => {
    const currentTodo = todos.find((t) => t._id === id);
    if (!currentTodo) return;

    fetch(`${apiUrl}/todos/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: !currentTodo.status }),
    })
      .then((res) => res.ok && res.json())
      .then((updatedTodo) => {
        if (updatedTodo) {
          // ✅ Auto-create next recurring task even if not done
          if (currentTodo.recurring !== "None") {
            const newDate = new Date(currentTodo.dueDate);
            if (currentTodo.recurring === "Daily")
              newDate.setDate(newDate.getDate() + 1);
            if (currentTodo.recurring === "Weekly")
              newDate.setDate(newDate.getDate() + 7);
            if (currentTodo.recurring === "Monthly")
              newDate.setMonth(newDate.getMonth() + 1);

            // Only add next recurring if not already exists for that date
            if (
              !todos.some(
                (t) =>
                  t.title === currentTodo.title &&
                  t.dueDate?.startsWith(newDate.toISOString().split("T")[0])
              )
            ) {
              fetch(apiUrl + "/todos", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  title: currentTodo.title,
                  description: currentTodo.description,
                  dueDate: newDate.toISOString().split("T")[0],
                  priority: currentTodo.priority,
                  recurring: currentTodo.recurring,
                }),
              })
                .then((res) => res.ok && res.json())
                .then((newTodo) => setTodos((prev) => [...prev, newTodo]));
            }
          }
          setTodos(todos.map((todo) => (todo._id === id ? updatedTodo : todo)));
        }
      })
      .catch(() => setError("Server not reachable"));
  };

  // Delete todo
  const deleteTodo = (id) => {
    fetch(`${apiUrl}/todos/${id}`, { method: "DELETE" })
      .then((res) => {
        if (res.status === 204) {
          setTodos(todos.filter((todo) => todo._id !== id));
        } else setError("Unable to delete todo");
      })
      .catch(() => setError("Server not reachable"));
  };

  // Update todo
  const updateTodo = async (id, updates) => {
    try {
      const res = await fetch(`${apiUrl}/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const updatedTodo = await res.json();
      setTodos((prevTodos) =>
        prevTodos.map((todo) => (todo._id === id ? updatedTodo : todo))
      );
    } catch (error) {
      console.error("❌ Update failed:", error);
      setError("Update failed");
    }
  };

  // Due status helper
  const getDueStatus = (dueDate, status) => {
    if (!dueDate || status) return "text-dark";
    const todayStr = new Date().toISOString().split("T")[0];
    const dueStr = new Date(dueDate).toISOString().split("T")[0];
    if (dueStr < todayStr) return "text-danger fw-bold";
    if (dueStr === todayStr) return "text-warning fw-bold";
    return "text-dark";
  };

  // Filter + sort + search
  const filteredTodos = todos
    .filter((todo) => {
      if (filter === "Completed") return todo.status;
      if (filter === "Pending") return !todo.status;
      return true;
    })
    .filter((todo) => todo.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

  // ✅ Calculate progress
  const completedCount = todos.filter((t) => t.status).length;
  const progressPercent = todos.length
    ? Math.round((completedCount / todos.length) * 100)
    : 0;

  return (
    <div className="ca card">
      <h1 className="headingca card">To-Do List</h1>

      {/* Progress bar */}
      <div className="progress m-2">
        <div
          className="progress-bar"
          role="progressbar"
          style={{ width: `${progressPercent}%` }}
        >
          {progressPercent}% Completed
        </div>
      </div>

      {/* Controls */}
      <div className="d-flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Search tasks..."
          className="form-control"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>All</option>
          <option>Completed</option>
          <option>Pending</option>
        </select>
      </div>

      {/* Add todo form */}
      <div className="box input-group m-2">
        <input
          type="text"
          className="fo form-control"
          placeholder="Work"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text"
          className="fo form-control"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="date"
          className="fo form-control"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <select
          className="form-select"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <select
          className="form-select"
          value={recurring}
          onChange={(e) => setRecurring(e.target.value)}
        >
          <option>None</option>
          <option>Daily</option>
          <option>Weekly</option>
          <option>Monthly</option>
        </select>
        <button
          className="but btn btn-outline-light"
          type="button"
          onClick={addTodo}
        
        >
          ADD
        </button>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {success && <p className="text-success">{success}</p>}

      {/* Todo list */}
      <ul className="toto-list list-group">
        {filteredTodos.map((item) => {
          const isEditing = item._id === editingId;
          const formattedDate = item.dueDate
            ? new Date(item.dueDate).toLocaleDateString("en-US", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })
            : null;

          return (
            <li
              key={item._id}
              className={`list-group-item d-flex justify-content-between align-items-center ${
                item.status
                  ? "text-decoration-line-through text-muted"
                  : getDueStatus(item.dueDate, item.status)
              }`}
              onClick={() => !isEditing && toggleStatus(item._id)}
              style={{ cursor: "pointer" }}
            >
              <div className="todo-text">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="form-control mb-1"
                    />
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="form-control mb-1"
                    />
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="form-control mb-1"
                    />
                    <select
                      className="form-select mb-1"
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                    <select
                      className="form-select mb-1"
                      value={editRecurring}
                      onChange={(e) => setEditRecurring(e.target.value)}
                    >
                      <option>None</option>
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </>
                ) : (
                  <>
                    <strong>{item.title}</strong>{" "}
                    <span className="badge bg-secondary">{item.priority}</span>
                    <br />
                    <span>{item.description}</span>
                    {item.dueDate && (
                      <div>
                        <small
                          className={getDueStatus(item.dueDate, item.status)}
                        >
                          Due: {formattedDate}
                        </small>
                      </div>
                    )}
                    {["Daily", "Weekly", "Monthly"].includes(
                      item.recurring
                    ) && (
                      <div>
                        <small className="text-info">
                          Repeats: {item.recurring}
                        </small>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="d-flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      className="btn btn-outline-success btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTodo(item._id, {
                          title: editTitle,
                          description: editDescription,
                          dueDate: editDueDate,
                          priority: editPriority,
                          recurring: editRecurring,
                        });
                        setEditingId(null);
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(null);
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(item._id);
                        setEditTitle(item.title);
                        setEditDescription(item.description);
                        setEditDueDate(
                          item.dueDate ? item.dueDate.split("T")[0] : ""
                        );
                        setEditPriority(item.priority || "Medium");
                        setEditRecurring(item.recurring || "None");
                      }}
                    >
                      Update
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTodo(item._id);
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
