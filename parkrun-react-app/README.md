# Parkrun React App

This is a React web application designed for iPhone that provides users with an engaging interface to explore parkrun events, results, and athlete information. The app features a scrollable opening page that discusses its capabilities and includes a hamburger menu for easy navigation.

## Features

- **Scrollable Opening Page**: Discusses the app's capabilities and provides an overview of its functionalities.
- **Hamburger Menu**: Offers navigation options to:
  - Home
  - Login
  - Results
  - Courses
  - Athletes
- **Integration with Backend**: Connects to a PostgreSQL database through the `backendAPI.ts` file to access and manage data.

## Project Structure

The project is organized as follows:

```
parkrun-react-app
├── public
│   └── index.html
├── src
│   ├── components
│   │   ├── HamburgerMenu.tsx
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── ResultsPage.tsx
│   │   ├── CoursesPage.tsx
│   │   └── AthletesPage.tsx
│   ├── pages
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Results.tsx
│   │   ├── Courses.tsx
│   │   └── Athletes.tsx
│   ├── api
│   │   └── backendAPI.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── styles
│       └── main.css
├── package.json
├── tsconfig.json
└── README.md
```

## Setup Instructions

1. **Clone the Repository**: 
   ```
   git clone <repository-url>
   cd parkrun-react-app
   ```

2. **Install Dependencies**: 
   ```
   npm install
   ```

3. **Run the Application**: 
   ```
   npm start
   ```

4. **Access the App**: Open your browser and navigate to `http://localhost:3000`.

## Usage

- Navigate through the app using the hamburger menu.
- Use the login page to set up your athlete code and password.
- View results and historical data on the respective pages.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License

This project is licensed under the MIT License.