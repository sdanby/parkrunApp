def get_last_positions():
    event_code = request.args.get('event_code', default=None, type=int)

    if event_code is None:
        return jsonify({"error": "event_code is required"}), 400

    # Query to get last positions for the specified event_code
    try:
        last_positions_query = (
            db.session.query(
                EventPosition.event_code,
                EventPosition.event_date,  # Get the event date directly
                func.max(EventPosition.position).label('last_position')  # Find the last position for the week
            )
            .filter(EventPosition.event_code == event_code)  # Filter by the given event_code
            .group_by(
                EventPosition.event_code,
                EventPosition.event_date  # Group by event code and event date
            )
            .all()
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if not last_positions_query:
        return jsonify({"message": "No records found for this event code"}), 404

    # Helper function to convert dd/mm/yyyy to ISO format (yyyy-mm-dd)
    def format_date_to_iso(date_str):
        try:
            if isinstance(date_str, str) and '/' in date_str:
                # Assume dd/mm/yyyy format
                parts = date_str.split('/')
                if len(parts) == 3:
                    day, month, year = parts
                    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            return str(date_str)  # Return as-is if not in expected format
        except:
            return str(date_str)  # Return as-is if conversion fails

    # Prepare the response with both original and formatted dates
    last_positions = [{
        'event_code': code,
        'event_date': date,  # Use event_date directly (original dd/mm/yyyy format)
        'formatted_date': format_date_to_iso(str(date)),  # ISO format (yyyy-mm-dd) for proper sorting
        'last_position': last_position
    } for code, date, last_position in last_positions_query]

    return jsonify(last_positions)  # Return the retrieved last positions as JSON